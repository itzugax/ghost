# 🚀 Configurar Backblaze B2 - Archivos hasta 500MB

## 📊 LÍMITES DE BACKBLAZE B2:

- ✅ **10GB gratis** de almacenamiento total
- ✅ **Archivos grandes** con bajo costo mensual
- ✅ **Sin tarjeta de crédito**
- ✅ **$0.005/GB/mes** después de 10GB ($0.05 por 10GB adicionales)

---

## 🎯 PLAN:

**Arquitectura actual:**
- Archivos cifrados en el navegador
- Proxy Node (`b2-proxy.js`) para subida/descarga/borrado en Backblaze B2
- **Límite recomendado: 500MB por archivo** (configurable con `B2_MAX_UPLOAD_MB`)

---

## 📝 PASOS DE CONFIGURACIÓN (10 minutos):

### 1️⃣ Crear cuenta en Backblaze

1. Ve a: https://www.backblaze.com/b2/sign-up.html
2. Completa el formulario:
   - Email
   - Contraseña
   - Nombre
3. **NO requiere tarjeta de crédito** ✅
4. Verifica tu email

---

### 2️⃣ Crear un Bucket

1. Inicia sesión en: https://secure.backblaze.com/
2. Ve a **B2 Cloud Storage** → **Buckets**
3. Click en **Create a Bucket**
4. Configuración:
   - **Bucket Name**: `ghost-drop-files` (debe ser único globalmente)
   - **Files in Bucket**: **Private**
   - **Object Lock**: **Disabled**
   - **Encryption**: **Disabled** (ya ciframos en el cliente)
5. Click en **Create a Bucket**

---

### 3️⃣ Crear Application Key

1. Ve a **App Keys** (menú izquierdo)
2. Click en **Add a New Application Key**
3. Configuración:
   - **Name**: `ghost-drop-app`
   - **Allow access to Bucket(s)**: Selecciona `ghost-drop-files`
   - **Type of Access**: **Read and Write**
   - **Allow List All Bucket Names**: ✅ Checked
   - **File name prefix**: (dejar vacío)
   - **Duration**: (dejar vacío = sin expiración)
4. Click en **Create New Key**

**⚠️ IMPORTANTE:** Copia y guarda estos datos (solo se muestran una vez):
- **keyID**: `xxxxxxxxxxxxxxxxx`
- **applicationKey**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

### 4️⃣ Obtener información del Bucket

1. Ve a **Buckets**
2. Click en tu bucket `ghost-drop-files`
3. Copia estos datos:
   - **Bucket ID**: `xxxxxxxxxxxxxxxxx`
   - **Endpoint**: `s3.us-west-004.backblazeb2.com` (o similar)

---

### 5️⃣ Configurar en tu app

Agrega estas variables a `.env.local`:

```env
# Backblaze B2 Configuration
B2_KEY_ID=tu_key_id_aqui
B2_APPLICATION_KEY=tu_application_key_aqui
B2_BUCKET_ID=tu_bucket_id_aqui
B2_BUCKET_NAME=ghost-drop-files
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
```

---

## 🔧 Variables recomendadas para producción

Además de las credenciales B2, define:

```env
B2_MAX_UPLOAD_MB=500
B2_RATE_LIMIT_WINDOW_MS=60000
B2_RATE_LIMIT_MAX_REQUESTS=120
B2_PROXY_TOKEN=elige_un_token_largo_y_unico
B2_ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
B2_ALLOW_SETUP_CORS=false
```

---

## 💰 COSTOS:

**Gratis:**
- Primeros 10GB de almacenamiento
- Primeros 1GB de descarga diaria
- Uploads ilimitados

**Después de 10GB:**
- $0.005/GB/mes de almacenamiento ($0.05 por 10GB)
- $0.01/GB de descarga (después de 1GB diario gratis)

**Ejemplo:**
- 20GB almacenados = $0.10/mes
- 100GB almacenados = $0.50/mes

---

## 📋 RESUMEN:

1. ✅ Crear cuenta (sin tarjeta)
2. ✅ Crear bucket privado
3. ✅ Crear application key
4. ✅ Copiar credenciales
5. ✅ Agregar a `.env.local`
6. ✅ Configurar variables de seguridad del proxy

---

**Con esto ya queda listo para usar B2 con un baseline más seguro en producción.** 🚀
