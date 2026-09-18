# Fix — catálogo público de propiedades caído para visitantes anónimos

Fecha: 2026-09-16
Verificado en producción (`https://app.granito.com.ar`) con requests reales, sin sesión iniciada.

**Estado**: Parte 1 (la vista `propiedades_publicas`) ✅ corregida y verificada. Parte 2 (las fotos, `propiedades_imagenes`) ✅ corregida y verificada — `supabase/migrations/0042_fix_propiedades_imagenes_anon.sql` corrida en producción. Ambas partes resueltas de punta a punta.

---

## El problema

El catálogo público de propiedades (`/inmobiliaria/:clienteId`) y la ficha individual (`/p/:id`) están **caídos para cualquier visitante sin sesión iniciada**. Un usuario logueado en la app no lo nota porque su sesión enmascara el problema (ver "Por qué no se detectó antes").

**Verificado**: entrando a `https://app.granito.com.ar/inmobiliaria/9a650205-3391-4162-a027-d0c5a8022bff` (cliente real, "Consorcio Los Jazmines") sin sesión iniciada, la página muestra:

> Inmobiliaria no encontrada
> Esta página no existe o no está disponible.

Y directo contra la API, sin pasar por el frontend:

```
GET /rest/v1/propiedades_publicas?select=titulo,precio_publicacion
→ 401 {"code":"42501","message":"permission denied for table propiedades"}
```

---

## Por qué pasa

Es un efecto colateral de la migración `0037_propiedades_publicas_view.sql`, que corrigió un hallazgo real de seguridad (`ANALISIS_BASE.md`, punto 1): la tabla `propiedades` exponía a `anon` columnas sensibles (`comprador_dni`, `comprador_telefono`, `observaciones_internas`, etc.) porque RLS filtra filas, no columnas.

La corrección creó una vista con solo las columnas seguras:

```sql
create or replace view public.propiedades_publicas
with (security_invoker = true) as
select
  id, cliente_id, titulo, tipo_propiedad, tipo_operacion, estado,
  precio_publicacion, moneda, direccion, localidad, provincia,
  latitud, longitud, ambientes, dormitorios, banios, cochera,
  metros_cubiertos, metros_totales, descripcion, created_at, updated_at
from public.propiedades;

revoke select on public.propiedades from anon;
grant select on public.propiedades_publicas to anon;
```

El problema es `with (security_invoker = true)`. Con esa opción, Postgres exige que el rol que consulta la vista (`anon`) tenga privilegios **también sobre la tabla base** (`propiedades`), no alcanza con el `grant` sobre la vista. Como la misma migración le revoca a `anon` el `SELECT` sobre `propiedades`, la vista quedó inutilizable para `anon` apenas se aplicó — el error es literalmente `permission denied for table propiedades`, no `propiedades_publicas`.

### Por qué no se detectó antes de aplicar la migración

Cualquier prueba hecha con una sesión de usuario logueado (rol `authenticated`, que sí conserva su `SELECT` sobre `propiedades` vía la policy `tenant_all_propiedades`) funciona sin problema — el JWT del usuario logueado reemplaza a la `anon key` en el cliente de Supabase aunque se esté mirando una página que en teoría es "pública". El bug solo aparece para un visitante real, sin cuenta, que es justamente el único tipo de usuario que entra por `/inmobiliaria/:clienteId` o `/p/:id` en producción.

---

## La solución

Sacar `security_invoker = true` de la vista. Sin esa opción, una vista en Postgres corre por default con los privilegios de **quien la creó** (típicamente un rol con acceso total, como el dueño del schema), no con los del rol que consulta — así alcanza con el `grant select` sobre la vista, sin tocar la tabla base.

La contrapartida: al no ser `security_invoker`, la vista deja de heredar automáticamente la policy de RLS de la tabla (`estado <> 'Baja'`), así que hay que replicar ese filtro a mano en el `WHERE` de la vista.

```sql
-- Migración de corrección (ej. 0041_fix_propiedades_publicas_view.sql)

create or replace view public.propiedades_publicas as
select
  id, cliente_id, titulo, tipo_propiedad, tipo_operacion, estado,
  precio_publicacion, moneda, direccion, localidad, provincia,
  latitud, longitud, ambientes, dormitorios, banios, cochera,
  metros_cubiertos, metros_totales, descripcion, created_at, updated_at
from public.propiedades
where estado <> 'Baja';
```

Notas:
- **No hace falta tocar el `revoke select on propiedades from anon`** — la tabla base sigue cerrada, que es lo que cierra la fuga original. La vista pasa a ser el único punto de entrada público, y con este cambio vuelve a funcionar.
- El resto de columnas seguras y la lista de campos no cambia — es el mismo `SELECT` que ya está, solo se saca la cláusula `with (security_invoker = true)` y se agrega el `where` que antes ponía la policy de RLS.
- No hace falta cambiar nada en `src/services/supabase.js` (`getPropiedadPublica`/`getPropiedadesPublicas` ya apuntan a la vista) ni en el frontend — el fix es 100% de la migración SQL.

---

## Cómo se verificó (parte 1) — RESUELTO

```bash
curl -s "https://itnibiidhnlgozwbddif.supabase.co/rest/v1/propiedades_publicas?select=titulo,precio_publicacion&limit=3" \
  -H "apikey: <anon key pública>" \
  -H "authorization: Bearer <anon key pública>"
```

Ahora devuelve `200` con datos reales. Se confirmó además que pedir una columna sensible a través de la vista (`select=titulo,comprador_dni`) da `400 column propiedades_publicas.comprador_dni does not exist` — ni siquiera está expuesta, la fuga original sigue cerrada. Y en el navegador, sin sesión iniciada, `/inmobiliaria/:clienteId` vuelve a mostrar el catálogo.

---

## Parte 2 — mismo problema, ahora en `propiedades_imagenes` (fotos)

Al reverificar la página completa (no solo la API de propiedades), la ficha carga pero **sin fotos**. La request de red real que dispara el frontend:

```
GET /rest/v1/propiedades_imagenes?select=propiedad_id,storage_path,orden&propiedad_id=in.(...)
→ 401 {"code":"42501","message":"permission denied for table propiedades"}
```

Mismo mensaje de error, mismo origen: la policy `public_select_propiedades_imagenes` (`0002_rls_propiedades_clientes.sql`) valida así:

```sql
create policy "public_select_propiedades_imagenes"
on propiedades_imagenes for select
to anon
using (
  exists (
    select 1 from propiedades p
    where p.id = propiedades_imagenes.propiedad_id and p.estado <> 'Baja'
  )
);
```

El `EXISTS` hace una consulta real contra `propiedades`, y esa subconsulta corre con los privilegios del rol que está consultando (`anon`) — no es una función `SECURITY DEFINER`, es una policy normal. Al revocarle a `anon` el `SELECT` sobre `propiedades` en `0037`, esta policy quedó inservible: la fila de `propiedades_imagenes` en teoría debería ser visible, pero el motor no puede ni evaluar la condición porque no tiene permiso para leer la tabla que consulta el `EXISTS`.

Se revisaron todas las demás referencias a `propiedades` dentro de policies/funciones del proyecto (`grep` sobre `supabase/migrations/`): las de `0026`/`0027` son RPCs `SECURITY DEFINER` (no les afecta, corren con privilegios del dueño de la función) y las de `0036` son policies de storage para el rol `authenticated` (que nunca perdió su `SELECT` sobre `propiedades`). **`propiedades_imagenes` es el único otro lugar afectado.**

### La solución

Dar a `anon` un permiso mínimo, a nivel de columna, sobre las dos columnas que el `EXISTS` necesita (`id`, `estado`) — no reabre la fuga porque son las únicas columnas visibles, y no son sensibles:

```sql
-- Migración de corrección (ej. 0042_fix_propiedades_imagenes_anon.sql)

grant select (id, estado) on public.propiedades to anon;
```

Con esto, un intento directo de `GET /rest/v1/propiedades?select=id,estado` funcionaría (dato no sensible), pero `select=comprador_dni` seguiría dando `permission denied` — el resto de columnas sigue cerrado.

### Cómo se verificó — RESUELTO

```bash
curl -s "https://itnibiidhnlgozwbddif.supabase.co/rest/v1/propiedades_imagenes?select=propiedad_id,storage_path&limit=3" \
  -H "apikey: <anon key pública>" \
  -H "authorization: Bearer <anon key pública>"
# → 200, con storage_paths reales

curl -s "https://itnibiidhnlgozwbddif.supabase.co/rest/v1/propiedades?select=comprador_dni&limit=1" \
  -H "apikey: <anon key pública>" \
  -H "authorization: Bearer <anon key pública>"
# → 401 permission denied for table propiedades (la fuga original sigue cerrada)
```

Confirmado: el grant quedó acotado a `id`/`estado` únicamente, ninguna otra columna de `propiedades` es accesible para `anon`.
