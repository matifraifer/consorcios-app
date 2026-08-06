-- Marca si un mensaje entrante de WhatsApp ya fue visto por el equipo desde
-- /whatsapp (no tiene nada que ver con el "leido" real de WhatsApp del lado
-- del contacto, es un estado propio nuestro). Default true para no afectar
-- el historico ni los mensajes salientes, que no necesitan este flag.
alter table whatsapp_mensajes add column if not exists leido boolean not null default true;
