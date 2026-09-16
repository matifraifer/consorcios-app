-- Teléfono de contacto de cada unidad (formato E.164), usado por el envío
-- manual de liquidación por WhatsApp (enviar-liquidacion-whatsapp). Convive
-- con la integración Baileys existente (mensajería manual, whatsapp_sesiones/
-- whatsapp_mensajes) — esta es un canal aparte.

alter table public.departamentos add column if not exists telefono text;
