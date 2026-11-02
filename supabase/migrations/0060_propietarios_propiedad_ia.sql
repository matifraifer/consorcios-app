-- Carga de propiedades con IA: propietarios detectados en la documentación.
--
-- buscar_contactos_coincidentes: para cada persona detectada, el drawer de nueva
-- propiedad muestra "Ya existe" antes de guardar. Compara el DNI normalizado (solo
-- dígitos: "20.123.456" = "20123456") y, aparte, nombre + apellido.
--
-- vincular_propietarios_propiedad: al guardar la propiedad, crea los contactos
-- confirmados por el usuario (o reutiliza los existentes) y los vincula a la
-- propiedad en una sola transacción, para no dejar contactos sueltos si algo falla.
--
-- Las dos son SECURITY INVOKER: corren con la RLS de contactos/contactos_propiedades
-- (cliente_id = current_cliente_id()).

create or replace function public.buscar_contactos_coincidentes(
  p_dni text,
  p_nombre text,
  p_apellido text
)
returns table (
  id integer,
  nombre text,
  apellido text,
  dni text,
  telefono text,
  email text,
  tipo text,
  tipos text[],
  coincidencia text
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      nullif(regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'), '') as dni,
      nullif(lower(trim(coalesce(p_nombre, ''))), '')               as nombre,
      nullif(lower(trim(coalesce(p_apellido, ''))), '')             as apellido
  )
  select c.id, c.nombre, c.apellido, c.dni, c.telefono, c.email, c.tipo, c.tipos,
         case when p.dni is not null and regexp_replace(coalesce(c.dni, ''), '\D', '', 'g') = p.dni
              then 'dni' else 'nombre' end as coincidencia
  from contactos c, params p
  where c.cliente_id = current_cliente_id()
    and c.activo is not false
    and (
      (p.dni is not null and regexp_replace(coalesce(c.dni, ''), '\D', '', 'g') = p.dni)
      or (p.nombre is not null and p.apellido is not null
          and lower(trim(c.nombre)) = p.nombre and lower(trim(c.apellido)) = p.apellido)
    )
  order by (p.dni is not null and regexp_replace(coalesce(c.dni, ''), '\D', '', 'g') = p.dni) desc, c.id
  limit 5
$$;

grant execute on function public.buscar_contactos_coincidentes(text, text, text) to authenticated;


-- p_propietarios: [{ contacto_id (null = crear o buscar por DNI), nombre, apellido, dni, telefono, email }]
-- Devuelve los ids de los contactos vinculados.
create or replace function public.vincular_propietarios_propiedad(
  p_propiedad_id uuid,
  p_propietarios jsonb
)
returns integer[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cliente_id  uuid := current_cliente_id();
  v_creado_por  text;
  v_item        jsonb;
  v_contacto    contactos%rowtype;
  v_contacto_id integer;
  v_dni         text;
  v_nombre      text;
  v_apellido    text;
  v_telefono    text;
  v_email       text;
  v_tipos       text[];
  v_ids         integer[] := '{}';
begin
  if v_cliente_id is null then
    raise exception 'Usuario sin cliente asignado.';
  end if;

  if not exists (select 1 from propiedades where id = p_propiedad_id and cliente_id = v_cliente_id) then
    raise exception 'La propiedad no existe.';
  end if;

  if jsonb_typeof(p_propietarios) is distinct from 'array' then
    raise exception 'Formato de propietarios inválido.';
  end if;

  select nombre_usuario into v_creado_por from usuarios where auth_user_id = auth.uid() limit 1;

  for v_item in select * from jsonb_array_elements(p_propietarios) loop
    v_contacto_id := nullif(v_item->>'contacto_id', '')::integer;
    v_dni      := nullif(regexp_replace(coalesce(v_item->>'dni', ''), '\D', '', 'g'), '');
    v_nombre   := nullif(trim(coalesce(v_item->>'nombre', '')), '');
    v_apellido := nullif(trim(coalesce(v_item->>'apellido', '')), '');
    v_telefono := nullif(trim(coalesce(v_item->>'telefono', '')), '');
    v_email    := nullif(lower(trim(coalesce(v_item->>'email', ''))), '');

    v_contacto := null;

    if v_contacto_id is not null then
      select * into v_contacto from contactos
      where id = v_contacto_id and cliente_id = v_cliente_id
      for update;
      if not found then
        raise exception 'El contacto seleccionado no existe.';
      end if;
    elsif v_dni is not null then
      -- Aunque el usuario no haya elegido un existente, no se duplica un DNI ya cargado
      select * into v_contacto from contactos
      where cliente_id = v_cliente_id and activo is not false
        and regexp_replace(coalesce(dni, ''), '\D', '', 'g') = v_dni
      order by id
      limit 1
      for update;
    end if;

    if v_contacto.id is not null then
      v_tipos := coalesce(nullif(v_contacto.tipos, '{}'), case when v_contacto.tipo is not null then array[v_contacto.tipo] else '{}'::text[] end);
      if not ('PROPIETARIO' = any(v_tipos)) then
        v_tipos := v_tipos || 'PROPIETARIO';
      end if;
      update contactos set
        tipos    = v_tipos,
        tipo     = coalesce(tipo, 'PROPIETARIO'),
        telefono = coalesce(nullif(telefono, ''), v_telefono),
        email    = coalesce(nullif(email, ''), v_email),
        dni      = coalesce(nullif(dni, ''), v_dni)
      where id = v_contacto.id;
      v_contacto_id := v_contacto.id;
    else
      if v_nombre is null or v_apellido is null then
        raise exception 'Cada propietario necesita nombre y apellido.';
      end if;
      insert into contactos (cliente_id, nombre, apellido, dni, telefono, email, tipo, tipos, activo, origen, creado_por)
      values (v_cliente_id, v_nombre, v_apellido, v_dni, v_telefono, v_email, 'PROPIETARIO', array['PROPIETARIO'], true, 'IA', v_creado_por)
      returning id into v_contacto_id;
    end if;

    if not exists (
      select 1 from contactos_propiedades where contacto_id = v_contacto_id and propiedad_id = p_propiedad_id
    ) then
      insert into contactos_propiedades (contacto_id, propiedad_id) values (v_contacto_id, p_propiedad_id);
    end if;

    if not (v_contacto_id = any(v_ids)) then
      v_ids := v_ids || v_contacto_id;
    end if;
  end loop;

  return v_ids;
end;
$$;

grant execute on function public.vincular_propietarios_propiedad(uuid, jsonb) to authenticated;
