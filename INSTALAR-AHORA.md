# 🚀 Instalar AHORA - Pasos finales

## ✅ Ya tienes configurado:

- ✅ Token de Telegram: `8481266962:AAEtx_AKbLqQleNTVieVZ8cCVjRBiyGcc48`
- ✅ Chat ID: `-1001003906371791`
- ✅ Archivo `.env.local` creado
- ✅ Módulo `storage-telegram.js` creado
- ✅ Módulo `storage-hybrid.js` actualizado

---

## 🔧 Paso 1: Solucionar PowerShell (30 segundos)

**Usa CMD en vez de PowerShell:**

1. Presiona `Win + R`
2. Escribe `cmd`
3. Enter
4. Ejecuta:
   ```cmd
   cd C:\Users\PC\Desktop\Nueva carpeta\ghost-main
   ```

---

## 📦 Paso 2: Instalar dependencias (2 minutos)

En CMD:

```cmd
npm install
npm install node-telegram-bot-api
npx playwright install
```

---

## 🧪 Paso 3: Probar que funciona (1 minuto)

```cmd
npm test
```

**Resultado esperado:** 12/12 tests ✅

---

## 🎯 Paso 4: Probar Telegram (opcional)

Crea un archivo `test-telegram.js`:

```javascript
import { testTelegramConnection, uploadToTelegram, downloadFromTelegram } from './storage-telegram.js';

async function test() {
  console.log('🧪 Probando conexión con Telegram...');
  
  // 1. Probar conexión
  const connected = await testTelegramConnection();
  if (!connected) {
    console.error('❌ No se pudo conectar con Telegram');
    return;
  }
  
  // 2. Probar upload
  console.log('\n📤 Probando upload...');
  const testBlob = new Blob(['Hola desde Ghost Drop!'], { type: 'text/plain' });
  const { fileId, messageId } = await uploadToTelegram(testBlob, 'test.txt');
  console.log(`✅ Archivo subido. File ID: ${fileId}, Message ID: ${messageId}`);
  
  // 3. Probar download
  console.log('\n📥 Probando download...');
  const downloadedBlob = await downloadFromTelegram(fileId);
  const text = await downloadedBlob.text();
  console.log(`✅ Archivo descargado. Contenido: "${text}"`);
  
  console.log('\n🎉 ¡Todo funciona!');
}

test().catch(console.error);
```

Ejecutar:
```cmd
node test-telegram.js
```

---

## 🌐 Paso 5: Probar localmente (1 minuto)

```cmd
npx serve . -p 3000
```

Abre http://localhost:3000

**Prueba:**
1. Crear sala aleatoria
2. Subir archivo pequeño (<50MB) → Irá a Supabase
3. Subir archivo grande (>50MB) → Irá a Telegram
4. Descargar y verificar

---

## 📝 Paso 6: Configurar Supabase (si no lo has hecho)

1. Edita `supabase-config.js`:
   ```javascript
   const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
   const SUPABASE_ANON_KEY = "TU_ANON_KEY";
   ```

2. Sigue `SETUP-SUPABASE.md` para crear tablas

3. **IMPORTANTE:** Agrega columna para Telegram:
   ```sql
   ALTER TABLE drops ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;
   ```

---

## 🚀 Paso 7: Deploy a Vercel (2 minutos)

```cmd
npm install -g vercel
vercel
```

**⚠️ IMPORTANTE:** En Vercel Dashboard, agrega variables de entorno:
- `TELEGRAM_BOT_TOKEN` = `8481266962:AAEtx_AKbLqQleNTVieVZ8cCVjRBiyGcc48`
- `TELEGRAM_CHAT_ID` = `-1001003906371791`

---

## ✅ Checklist final

```
[ ] CMD abierto
[ ] npm install ejecutado
[ ] node-telegram-bot-api instalado
[ ] npx playwright install ejecutado
[ ] npm test → 12/12 tests ✅
[ ] Supabase configurado
[ ] Columna telegram_message_id agregada
[ ] Probado localmente (npx serve . -p 3000)
[ ] Deploy a Vercel
[ ] Variables de entorno en Vercel
[ ] Lanzar 🚀
```

---

## 🎉 Resultado final

**Tu app ahora soporta:**
- ✅ Archivos <50MB → Supabase
- ✅ Archivos 50MB-2GB → Telegram
- ✅ Cifrado E2E
- ✅ Auto-destrucción
- ✅ Gratis para siempre
- ✅ Sin tarjeta

**Límite total: 2GB por archivo** 🎉

---

## 🐛 Si algo falla

### "npm no se reconoce"
- Estás en PowerShell, usa CMD

### "Cannot find module 'node-telegram-bot-api'"
```cmd
npm install node-telegram-bot-api
```

### Tests fallan
- Verifica que Supabase esté configurado
- Verifica que las credenciales sean correctas

### Telegram no funciona
- Verifica que el bot sea administrador del canal
- Verifica que el Chat ID tenga el prefijo `-100`

---

## 📚 Documentación

- `SETUP-TELEGRAM-STORAGE.md` - Guía completa de Telegram
- `SETUP-SUPABASE.md` - Configurar Supabase
- `LEEME-PRIMERO.md` - Resumen general

---

## 🎯 Próximo comando

**Abre CMD y ejecuta:**

```cmd
cd C:\Users\PC\Desktop\Nueva carpeta\ghost-main
npm install
```

---

**¡Estás a 5 minutos de tener todo funcionando! 🚀**
