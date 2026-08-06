-- Soporte para sincronizar el historial de mensajes que WhatsApp manda al
-- vincular un dispositivo (evento messaging-history.set de Baileys). Necesita
-- una forma de no duplicar filas si el mismo mensaje llega mas de una vez
-- (reconexiones, reintentos de sync, etc.) via upsert por wa_message_id.
--
-- No parcial (sin "where wa_message_id is not null"): Postgres no acepta un
-- indice unico parcial como arbitro de ON CONFLICT salvo que la consulta
-- repita el mismo predicado, y PostgREST/supabase-js no permite eso desde
-- .upsert(). No hace falta el predicado igual: un indice unico normal ya
-- permite multiples filas con NULL sin chocar entre si.
create unique index if not exists idx_whatsapp_mensajes_wa_message_id
  on whatsapp_mensajes (cliente_id, wa_message_id);
