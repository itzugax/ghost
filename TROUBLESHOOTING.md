# 🔧 Solución de Problemas - Ghost Drop

## Problemas Comunes y Soluciones

### 1. 🌐 El botón de cambio de idioma no funciona

**Síntomas:**
- El botón de idioma no responde al hacer clic
- No cambia entre ES/EN

**Solución:**
```javascript
// Verificar en la consola del navegador:
console.log(window.i18n); // Debe mostrar el objeto i18n

// Si es null o undefined, recargar la página
location.reload();
```

**Causa:** El sistema i18n no se inicializó correctamente.

### 2. 📁 Error al subir archivos de más de 50MB

**Síntomas:**
- Error "Archivo demasiado grande" para archivos >50MB
- Archivos grandes no se suben

**Solución:**
1. Verificar que el proxy B2 esté funcionando:
```bash
# En desarrollo
npm run proxy

# Verificar en el navegador
fetch('/health').then(r => r.json()).then(console.log)
```

2. Configurar variables de entorno en `.env.local`:
```env
B2_KEY_ID=tu_key_id
B2_APPLICATION_KEY=tu_application_key
B2_BUCKET_NAME=tu_bucket_name
B2_ENDPOINT=s3.us-east-005.backblazeb2.com
```

### 3. 🔐 Error de cifrado/descifrado

**Síntomas:**
- "No se pudo cifrar el archivo"
- "No se pudo descifrar el archivo"

**Solución:**
```javascript
// Verificar Web Crypto API
console.log(window.crypto?.subtle); // Debe existir

// Verificar que estés en HTTPS o localhost
console.log(location.protocol); // Debe ser https: o http: (solo localhost)
```

**Causa:** Web Crypto API solo funciona en contextos seguros (HTTPS o localhost).

### 4. 🌐 Errores de CORS

**Síntomas:**
- "Origin blocked by CORS policy"
- Archivos no se descargan

**Solución para desarrollo:**
```bash
# Iniciar servidor local
npx serve . -p 3000
# NO usar file:// protocol
```

**Solución para producción:**
1. Configurar `B2_ALLOWED_ORIGINS` en `.env.local`
2. Ejecutar setup de CORS:
```bash
curl -X POST http://localhost:3001/setup-cors
```

### 5. 🔄 La sala no se conecta

**Síntomas:**
- "Error de conexión"
- No se ven archivos de otros usuarios

**Solución:**
1. Verificar configuración de Supabase:
```javascript
// En la consola del navegador
console.log(window.SUPABASE_URL);
console.log(window.SUPABASE_ANON_KEY);
```

2. Verificar conexión:
```javascript
window.db.from('rooms').select('*').limit(1)
  .then(console.log)
  .catch(console.error);
```

### 6. ⏱️ Los archivos no expiran correctamente

**Síntomas:**
- Archivos permanecen después del tiempo límite
- Timers no funcionan

**Solución:**
```javascript
// Verificar sincronización de tiempo
console.log('Cliente:', new Date());
console.log('Servidor offset:', window.serverTimeOffset);

// Forzar limpieza manual
cleanExpired({ silent: false });
```

### 7. 📱 Problemas en móviles

**Síntomas:**
- Interfaz no responde en móvil
- Drag & drop no funciona

**Solución:**
- Usar el botón "toca para seleccionar" en lugar de drag & drop
- Verificar que el navegador soporte Web Crypto API
- Probar en Chrome/Safari móvil

### 8. 🚀 Problemas de rendimiento

**Síntomas:**
- Subidas muy lentas
- Interfaz se congela

**Solución:**
1. Verificar tamaño de archivos:
```javascript
// Máximo recomendado por tipo
const limits = {
  supabase: 50 * 1024 * 1024,  // 50MB
  b2: 500 * 1024 * 1024        // 500MB
};
```

2. Subir archivos de uno en uno para archivos >100MB

### 9. 🔧 Modo de desarrollo

**Verificar configuración completa:**
```javascript
// Ejecutar en la consola
window.devConfig.checkDevEnvironment();
```

**Resultado esperado:**
```
✅ Configuración de Supabase OK
✅ Web Crypto API disponible  
✅ Proxy B2 funcionando
✅ Todas las funciones disponibles
```

## 🆘 Obtener Ayuda

Si ninguna solución funciona:

1. **Abrir DevTools** (F12)
2. **Ir a Console**
3. **Ejecutar diagnóstico:**
```javascript
window.devConfig.checkDevEnvironment();
```

4. **Copiar errores** y crear un issue en GitHub con:
   - Navegador y versión
   - Sistema operativo  
   - Pasos para reproducir
   - Mensajes de error completos
   - Resultado del diagnóstico

## 🔄 Reset Completo

Si todo falla, reset completo:

```bash
# 1. Limpiar dependencias
rm -rf node_modules package-lock.json
npm install

# 2. Limpiar localStorage
# En DevTools > Application > Storage > Clear All

# 3. Recargar configuración
# Editar supabase-config.js con credenciales correctas

# 4. Reiniciar servidor
npm start
```

## 📞 Contacto

- **GitHub Issues:** [github.com/itzugax/ghost/issues](https://github.com/itzugax/ghost/issues)
- **Email:** jorgeugax@gmail.com
- **Discord:** Próximamente

---

*Última actualización: Enero 2026*