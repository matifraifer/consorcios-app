# whatsapp-service

Proceso Node persistente que mantiene la conexión de Baileys (WhatsApp por QR) por `cliente_id`. Se deploya en Railway como servicio independiente del frontend (Vercel), con "Root Directory" apuntando a esta carpeta.

## Desarrollo local

```
cd whatsapp-service
cp .env.example .env   # completar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

## Variables de entorno

- `SUPABASE_URL` — misma URL del proyecto que usa el frontend.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API. Nunca va en el frontend ni en Vercel.
- `ALLOWED_ORIGIN` — orígenes permitidos por CORS, separados por coma (ej: `http://localhost:5173,https://consorcios-app.vercel.app`).
- `PORT` — Railway lo setea solo.

## Endpoints

- `GET /health`
- `POST /sessions/:clienteId/connect` — arranca (o reanuda) la sesión de WhatsApp del cliente.
- `POST /sessions/:clienteId/disconnect` — cierra sesión y borra las credenciales guardadas.
- `POST /sessions/:clienteId/send` — body `{ telefono, body }`.

Todos requieren header `Authorization: Bearer <access_token>` de un usuario logueado en Supabase Auth cuyo `usuarios.cliente_id` coincida con `:clienteId`.
