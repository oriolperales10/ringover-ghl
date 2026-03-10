# Ringover × GHL Bridge

Servidor de integración que conecta **GoHighLevel** con **Ringover** para hacer click-to-call desde el pipeline.

## Cómo funciona

```
GHL Pipeline (click teléfono)
        ↓
  Custom Action / Webhook
        ↓
  Este servidor (POST /ghl/call)
        ↓
  Ringover API (/callback)
        ↓
  Tu agente recibe llamada → conecta con el lead
```

## Instalación rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar API key (ya incluida en .env)
# RINGOVER_API_KEY=6c230fd65d66143ebdf1748983fa174d8a4948d4

# 3. Arrancar el servidor
node server.js
```

## Despliegue en producción

### Opción A – Railway (recomendado, gratis)
1. Crear cuenta en railway.app
2. New Project → Deploy from GitHub
3. Subir esta carpeta
4. Railway te da una URL pública automáticamente

### Opción B – Render
1. render.com → New Web Service
2. Conectar repo, comando de inicio: `node server.js`

### Opción C – VPS (Hetzner/DigitalOcean)
```bash
# Con PM2
npm install -g pm2
pm2 start server.js --name ringover-ghl
pm2 save && pm2 startup
```

## Configurar en GHL

### Paso 1 – Custom Action
1. GHL → Settings → Integrations → **Custom Actions**
2. "Add Action" → tipo **HTTP Request**
3. Method: **POST**
4. URL: `https://TU-SERVIDOR.com/ghl/call`
5. Headers: `Content-Type: application/json`

### Paso 2 – Body de la petición
```json
{
  "contact_phone": "{{contact.phone}}",
  "contact_name": "{{contact.name}}",
  "contact_id": "{{contact.id}}"
}
```

### Paso 3 – Asignar al pipeline
1. Ve al pipeline → contacto → icono de teléfono (...)
2. O crea un **Workflow** que dispare la Custom Action al hacer click en llamar

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/ghl/call` | Endpoint principal desde GHL |
| POST | `/ghl/webhook` | Webhook genérico (payload nativo GHL) |
| GET  | `/ringover/users` | Lista de agentes |
| GET  | `/ringover/numbers` | Lista de números |
| GET  | `/ringover/calls` | Historial de llamadas |
| GET  | `/health` | Estado de la conexión |
| GET  | `/` | Dashboard web |

## Flujo de llamada

Cuando GHL llama a `/ghl/call`:
1. Tu agente recibe una llamada en su dispositivo (app/web/SIP/móvil)
2. El agente descuelga
3. Ringover automáticamente llama al lead
4. Se establece la conferencia

## Soporte
API Key configurada: `6c230fd65...` (Ringover)
