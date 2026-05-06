# 🔧 Configuración de Variables de Entorno en Vercel

Para que los archivos >50MB funcionen en producción, necesitas configurar las variables de entorno de Backblaze B2 en Vercel.

## 📋 Variables Requeridas

Ve a tu **Vercel Dashboard** → **Tu Proyecto** → **Settings** → **Environment Variables** y agrega:

### 🔑 Credenciales B2 (OBLIGATORIAS)
```
B2_KEY_ID=005bb24a6b7abe50000000001
B2_APPLICATION_KEY=K005nd6l4sOPyx0Vb1tAlDEOiAOGeNI
B2_BUCKET_ID=eb5b32f44ad6fba79adb0e15
B2_BUCKET_NAME=ghost-drop-files
B2_ENDPOINT=s3.us-east-005.backblazeb2.com
```

### ⚙️ Configuración Opcional
```
B2_MAX_UPLOAD_MB=500
B2_RATE_LIMIT_WINDOW_MS=60000
B2_RATE_LIMIT_MAX_REQUESTS=120
B2_ALLOWED_ORIGINS=https://tu-dominio.vercel.app
```

## 🚀 Pasos para Configurar

1. **Ir a Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Selecciona tu proyecto Ghost Drop

2. **Abrir Settings:**
   - Click en "Settings" en la barra superior
   - Click en "Environment Variables" en el menú lateral

3. **Agregar Variables:**
   - Click "Add New"
   - Name: `B2_KEY_ID`
   - Value: `005bb24a6b7abe50000000001`
   - Environment: `Production`, `Preview`, `Development`
   - Click "Save"

4. **Repetir para todas las variables**

5. **Redesplegar:**
   - Ve a "Deployments"
   - Click en los 3 puntos del último deployment
   - Click "Redeploy"

## ✅ Verificar Configuración

Después de configurar, ve a tu app y ejecuta en la consola:
```javascript
fetch('/health').then(r => r.json()).then(console.log)
```

Deberías ver:
```json
{
  "status": "ok",
  "service": "b2-proxy",
  "bucket": "ghost-drop-files",
  "keyId": "CONFIGURED",
  "appKey": "CONFIGURED"
}
```

## 🔍 Troubleshooting

### Si ves "NOT_CONFIGURED":
- Las variables no están configuradas en Vercel
- Verifica que los nombres sean exactos (case-sensitive)
- Redesplega después de agregar variables

### Si ves errores 401:
- Credenciales B2 incorrectas
- Verifica que el Key ID y Application Key sean correctos

### Si ves errores de CORS:
- Agrega tu dominio a `B2_ALLOWED_ORIGINS`
- Formato: `https://tu-app.vercel.app`

## 📞 Soporte

Si sigues teniendo problemas:
1. Ejecuta `quickTest()` en la consola
2. Copia el resultado completo
3. Incluye screenshot del health check