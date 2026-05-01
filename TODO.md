# ✅ Checklist — Ghost Drop v3.3.0

## 🧪 Probar localmente (AHORA)

```bash
# 1. Servir archivos
npx serve .

# 2. Abrir en navegador
# http://localhost:3000

# 3. Probar flujo completo:
```

- [ ] Abrir en 2 pestañas diferentes
- [ ] Pestaña 1: Crear sala aleatoria (🎲)
- [ ] Copiar código de sala
- [ ] Pestaña 2: Entrar con el mismo código
- [ ] Pestaña 1: Subir un archivo pequeño (imagen)
- [ ] Verificar que aparece en Pestaña 2 (realtime)
- [ ] Pestaña 2: Descargar el archivo
- [ ] Verificar que se descarga correctamente
- [ ] Verificar que el preview de imagen funciona (👁)

**Si todo funciona:** ✅ Listo para producción

**Si algo falla:**
- Abre consola (F12)
- Busca errores en rojo
- Verifica que `crypto.js` se carga
- Verifica que `SUPABASE_URL` y `SUPABASE_ANON_KEY` están configurados

---

## 🗄️ Actualizar Supabase (si no lo hiciste)

```sql
-- Ejecutar en Supabase → SQL Editor

-- 1. Verificar que content_type existe
ALTER TABLE drops ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'file';

-- 2. Agregar columna burn_after_reading (NUEVO)
ALTER TABLE drops ADD COLUMN IF NOT EXISTS burn_after_reading BOOLEAN DEFAULT false;

-- 3. Limpiar datos antiguos (opcional, solo si quieres empezar de cero)
DELETE FROM drops;
DELETE FROM rooms;
```

**Storage:**
- Dashboard → Storage → ghost-drop
- Si tienes archivos antiguos, bórralos (no se podrán descifrar)

---

## 🚀 Deploy a producción

### Vercel (recomendado)

```bash
# 1. Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# 2. Deploy
vercel

# 3. Seguir instrucciones
# - Link to existing project? Yes
# - Deploy? Yes

# 4. Copiar URL de producción
# Ejemplo: https://ghost-drop.vercel.app
```

### Actualizar URLs en código

- [ ] `index.html` → Meta tags OG/Twitter → Cambiar URL
- [ ] `README.md` → Links de demo → Cambiar URL
- [ ] `LAUNCH.md` → Templates → Cambiar [tu-url]

---

## 🎨 Crear assets (antes de lanzar)

### 1. Video demo (30 segundos)

**Herramienta:** OBS Studio (gratis)

**Guión:**
1. Pantalla en blanco → "Compartir archivos en 2026..."
2. Mostrar WeTransfer/Dropbox → "Registro, email, espera..."
3. Corte → "Ghost Drop"
4. Mostrar: Entrar código → Arrastrar archivo → Listo
5. Texto final: "5 segundos. Cero fricción."

**Exportar:** MP4, 1920x1080, <10MB

---

### 2. GIF animado (10 segundos)

**Herramienta:** ScreenToGif (Windows) o Gifski (Mac)

**Capturar:**
1. Entrar código de 6 dígitos
2. Arrastrar archivo
3. Archivo aparece en lista
4. Descargar

**Exportar:** GIF, 800x600, <5MB

---

### 3. Imagen OG (para redes sociales)

**Herramienta:** Canva (gratis)

**Tamaño:** 1200x630px

**Contenido:**
```
👻 Ghost Drop

Comparte archivos en 5 segundos
Sin registro · Sin apps · Cifrado E2E

[Screenshot de la app]

ghostdrop.vercel.app
```

**Guardar como:** `og-image.png` en la raíz del proyecto

**Actualizar en `index.html`:**
```html
<meta property="og:image" content="https://tu-url.vercel.app/og-image.png" />
<meta property="twitter:image" content="https://tu-url.vercel.app/og-image.png" />
```

---

## 📱 Preparar cuentas (si no las tienes)

- [ ] **Product Hunt**
  - Crear cuenta: https://producthunt.com
  - Completar perfil (foto, bio)
  - Seguir a algunos makers

- [ ] **Reddit**
  - Crear cuenta (si no tienes)
  - Conseguir karma: comentar en otros posts (10-50 karma mínimo)
  - Leer reglas de cada subreddit

- [ ] **Twitter/X**
  - Perfil completo
  - Bio clara: "Maker de Ghost Drop"
  - Link a tu proyecto

- [ ] **Hacker News**
  - Crear cuenta: https://news.ycombinator.com
  - Leer guidelines: https://news.ycombinator.com/newsguidelines.html

---

## 🚀 Lanzamiento (cuando estés listo)

### Día antes
- [ ] Revisar `LAUNCH.md` completo
- [ ] Preparar todos los templates (copy/paste listos)
- [ ] Verificar que la app funciona en producción
- [ ] Dormir bien (vas a necesitar energía)

### Día del lanzamiento

**Product Hunt** (jueves, 00:01 PST)
- [ ] Lanzar a las 00:01 PST (convertir a tu zona horaria)
- [ ] Subir video/GIF
- [ ] Pegar copy preparado
- [ ] Responder comentarios cada 30 min (primeras 6 horas)

**Reddit** (mismo día, 9am-12pm EST)
- [ ] r/InternetIsBeautiful
- [ ] r/SideProject
- [ ] r/webdev (enfoque técnico)
- [ ] Responder comentarios rápido

**Hacker News** (lunes-miércoles, 8-10am EST)
- [ ] Post con "Show HN:" en título
- [ ] Responder preguntas técnicas
- [ ] Ser humilde y receptivo

**Twitter** (cuando quieras)
- [ ] Thread de 10 tweets
- [ ] Incluir GIF/video
- [ ] Hashtags: #buildinpublic #indiehacker
- [ ] Responder replies

---

## 📊 Post-lanzamiento

### Primeras 24 horas
- [ ] Responder TODOS los comentarios
- [ ] Agregar features sugeridas a roadmap
- [ ] Fixear bugs críticos inmediatamente
- [ ] Celebrar 🎉

### Primera semana
- [ ] Escribir post-mortem
- [ ] Agregar testimonios al README
- [ ] Optimizar basado en feedback
- [ ] Planear v3.4.0

### Primer mes
- [ ] Analizar métricas (visitas, archivos compartidos)
- [ ] Iterar basado en datos
- [ ] Considerar monetización (donaciones)
- [ ] Seguir construyendo en público

---

## 💰 Monetización (opcional, sin presión)

### Opción 1: Donaciones (Ko-fi)
- [ ] Crear cuenta: https://ko-fi.com
- [ ] Configurar perfil
- [ ] Descomentar línea en `index.html`:
  ```html
  <a href="https://ko-fi.com/tuusuario">☕ Si te salvó, invítame un café</a>
  ```

### Opción 2: Patrocinios de eventos
- [ ] Crear página "Ghost Drop para eventos"
- [ ] Precio: $99/evento
- [ ] Ofrecer: logo custom + dominio
- [ ] Contactar organizadores de eventos tech

### Opción 3: GitHub Sponsors
- [ ] Habilitar GitHub Sponsors
- [ ] Tiers: $3, $10, $25/mes
- [ ] Beneficios: badge, early access, soporte prioritario

---

## 🎯 Métricas a trackear

### Analytics (ya tienes Google Analytics)
- Visitas únicas
- Páginas vistas
- Tiempo en sitio
- Tasa de rebote

### Custom (agregar a Supabase)
```sql
-- Ya tienes esto en MIGRATION.sql
SELECT value FROM stats WHERE key = 'total_uploads';
```

### Feedback
- Comentarios en Product Hunt
- Issues en GitHub
- Mensajes directos
- Tweets mencionando el proyecto

---

## 🐛 Si algo sale mal

### Error: "No se pudo cifrar el archivo"
- Verificar que `crypto.js` se carga
- Verificar que el navegador soporta Web Crypto API
- Probar en Chrome/Firefox (Safari puede tener issues)

### Error: "No se pudo descifrar el archivo"
- Verificar que estás en la misma sala
- Verificar que el archivo se subió con v3.3.0
- Archivos antiguos (v3.2.0) no se pueden descifrar

### Error: "Supabase connection failed"
- Verificar `supabase-config.js`
- Verificar que `SUPABASE_URL` y `SUPABASE_ANON_KEY` son correctos
- Verificar que el proyecto de Supabase está activo

### Rollback de emergencia
```bash
git checkout v3.2.0
vercel --prod
```

---

## ✅ Checklist final antes de lanzar

- [ ] App funciona localmente
- [ ] App funciona en producción
- [ ] Video demo listo
- [ ] GIF animado listo
- [ ] Imagen OG lista
- [ ] Copy de lanzamiento preparado
- [ ] Cuentas creadas (PH, Reddit, HN, Twitter)
- [ ] URLs actualizadas en todos los templates
- [ ] README actualizado
- [ ] Changelog actualizado
- [ ] Dormiste bien
- [ ] Estás emocionado 🚀

---

## 🎉 ¡Listo!

Tienes todo lo necesario para lanzar. El código está listo, la documentación está completa, y el plan de lanzamiento está preparado.

**Próximo paso:** Probar localmente y cuando estés listo, ¡lanzar!

**Recuerda:**
- El lanzamiento es solo el inicio
- Responde rápido a comentarios
- Itera basado en feedback
- Construye en público
- Disfruta el proceso

¡Mucha suerte! 👻🚀
