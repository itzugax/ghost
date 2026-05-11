# 🚀 Setup Cloudflare Worker para B2 con caché edge

## ¿Por qué esto?
- B2 tiene límite de 1GB/día de descarga
- Cloudflare Worker hace de proxy con **caché edge** (las descargas repetidas no tocan B2)
- **Bandwidth Alliance**: tráfico B2 → Cloudflare es gratis, sin contar el límite diario
- 100,000 requests/día gratis en Cloudflare Workers

## 📋 Pasos

### 1. Tener cuenta Cloudflare (si no, créala)
- Ve a https://dash.cloudflare.com/sign-up
- NO requiere tarjeta

### 2. Crear Worker
1. Ve a https://dash.cloudflare.com/ → **Workers & Pages**
2. Click **"Create Application"** → **"Create Worker"**
3. Nombre: `ghost-b2-proxy`
4. Click **"Deploy"**

### 3. Pegar el código del Worker
1. Click **"Edit Code"**
2. Borra todo y pega el contenido de `cloudflare-worker-b2.js`
3. Click **"Save and Deploy"**

### 4. Configurar variables de entorno
1. Ve a **Settings** → **Variables**
2. Agrega estas variables:

| Variable | Valor (ejemplo) |
|---|---|
| `B2_KEY_ID` | Tu B2 Application Key ID |
| `B2_APPLICATION_KEY` | Tu B2 Application Key |
| `B2_BUCKET_NAME` | Tu bucket de B2 (ej: `ghost-drop-files`) |
| `VERCEL_ORIGIN` | URL de tu app en Vercel (ej: `https://ghost-drop.vercel.app`) |

3. Click **"Save"**

### 5. Actualizar `storage-b2-client.js`
Si tu Worker está en `https://ghost-b2-proxy.tuuser.workers.dev`, esa URL ya está configurada en la línea 7 de `storage-b2-client.js` como `PROXY_URL`.

### 6. ✅ ¡Listo!

El Worker ahora:
- ✅ Sirve descargas con caché edge (archivos populares no gastan banda de B2)
- ✅ Se beneficia de la Bandwidth Alliance (B2 → Cloudflare = gratis)
- ✅ Proxy de subida hacia Vercel (sin cambios)
- ✅ Proxy de borrado hacia Vercel

## ⚠️ Nota sobre el límite de 1GB/día de B2

Si el Bandwidth Alliance no elimina el límite de 1GB/día:
- El Worker intentará descargar de B2 y fallará si el límite se alcanzó
- **Solución temporal**: Reduce el tamaño máximo en `selectStorage()` en `app.js:1462` a 100MB para estirar más el límite
- **Solución permanente**: Migrar a Cloudflare R2 mañana cuando tengas tarjeta

## 📊 Límites Cloudflare Workers (Plan Gratis)
- 100,000 requests/día
- Sin límite de ancho de banda (para respuestas cacheadas)
