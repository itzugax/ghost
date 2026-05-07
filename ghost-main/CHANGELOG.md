# 📝 Changelog

## [3.6.0] - 2026-05-06

### 🚀 Mejoras Principales
- **Botón de idioma arreglado**: Funciona al primer click en todas las páginas (landing, app, privacidad, términos)
- **Progreso B2 mejorado**: Barra de progreso visual durante descargas de Backblaze B2
- **Sin silencios**: Feedback continuo durante descarga → descifrado → completado
- **Múltiples estrategias**: Inicialización robusta que funciona en cualquier timing de carga

### 🔧 Correcciones Técnicas
- **Eliminados botones duplicados**: Todas las páginas HTML tenían IDs duplicados que causaban conflictos
- **Scope de variables arreglado**: Error "progressEl is not defined" solucionado
- **Event listeners limpios**: Sin duplicados, usando onclick directo para mayor confiabilidad
- **Timers de respaldo**: Progreso garantizado incluso si los callbacks fallan

### 🌐 Internacionalización
- **Inicialización múltiple**: DOMContentLoaded, pageshow, load events
- **Prevención de duplicados**: Sistema robusto que evita múltiples inicializaciones
- **Logs de debugging**: Visibilidad completa del proceso de cambio de idioma
- **Actualización forzada**: UI se refresca correctamente después del cambio

## [3.3.0] - 2026-04-28

### 🔥 Nuevas Features
- **Burn After Reading**: Los archivos se borran automáticamente después de 1 descarga
- **Descargar Todo como ZIP**: Descarga todos los archivos de la sala en un solo ZIP
- **Páginas Legales**: Términos de servicio y política de privacidad

### 🔐 Seguridad
- **Cifrado E2E implementado**: Todos los archivos se cifran con AES-256-GCM antes de subirlos
- **Clave derivada del código de sala**: Usa PBKDF2 con 100,000 iteraciones
- **Supabase solo ve bytes cifrados**: Privacidad real, no solo promesas
- **Web Crypto API nativa**: Sin dependencias externas, usa el crypto del navegador

### ✨ Mejoras
- **Nuevo tagline**: "Comparte archivos en 5 segundos. Sin registro. Sin apps. Cifrado E2E."
- **README actualizado**: Tabla comparativa con otras apps, casos de uso claros
- **Meta tags mejorados**: SEO optimizado, Open Graph para redes sociales
- **Manifest actualizado**: Mejor descripción para PWA

### 📚 Documentación
- **LAUNCH.md**: Guía completa para lanzar en Product Hunt, Reddit, HN, Twitter
- **UPGRADE-TO-E2E.md**: Instrucciones para migrar desde versión anterior
- **Notas de seguridad actualizadas**: Explicación clara del cifrado

### 🔧 Técnico
- Nuevo módulo `crypto.js` con funciones de cifrado/descifrado
- `uploadFiles()` ahora cifra antes de subir
- `downloadAndDestroy()` descifra después de descargar
- `loadThumbnail()` descifra previews de imágenes
- `content_type` guardado en DB para descifrado correcto

### 🎨 UI/UX
- Mensajes de progreso: "Cifrando…", "Descifrando…"
- Footer actualizado: "Cifrado E2E · Cero fricción"
- Versión actualizada a v3.3.0

---

## [3.2.0] - Anterior

### Características
- Compartir archivos efímeros
- Salas con códigos de 6 dígitos
- Auto-destrucción (1-15 min)
- Realtime con Supabase
- PWA con soporte offline
- QR codes para invitar
- Typing indicators
- Rate limiting
- Analytics integrado

---

## Roadmap

### v3.4.0 (próximo)
- [ ] Cifrado de mensajes de texto
- [ ] Modo oscuro mejorado
- [ ] Compresión de imágenes antes de cifrar
- [ ] Soporte para carpetas (zip automático)

### v3.5.0
- [ ] Salas con contraseña adicional (2FA)
- [ ] Historial de archivos compartidos (local)
- [ ] Integración con clipboard API
- [ ] Arrastrar múltiples archivos a la vez

### v4.0.0
- [ ] P2P opcional (WebRTC) para archivos grandes
- [ ] Modo "burn after reading" (se borra al abrir)
- [ ] API pública para integraciones
- [ ] Temas personalizables

---

## Notas de migración

### De v3.2.0 a v3.3.0

**⚠️ BREAKING CHANGE**: Los archivos subidos en v3.2.0 no se pueden descargar en v3.3.0 porque no están cifrados.

**Soluciones:**
1. Empezar de cero (recomendado para desarrollo)
2. Mantener v3.2.0 en producción hasta que expiren todos los archivos
3. Implementar compatibilidad hacia atrás (ver UPGRADE-TO-E2E.md)

**Pasos:**
1. Actualizar código: `git pull`
2. Limpiar storage: Dashboard → Storage → ghost-drop → Delete all
3. Limpiar DB: `DELETE FROM drops; DELETE FROM rooms;`
4. Verificar: Subir y descargar archivo de prueba

---

## Contribuir

¿Encontraste un bug? ¿Tienes una idea?

1. Abre un issue en GitHub
2. Describe el problema/idea claramente
3. Si es un bug, incluye pasos para reproducir
4. Si es una feature, explica el caso de uso

Pull requests bienvenidos! 🚀
