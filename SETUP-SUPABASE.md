# 🔧 Configuración de Supabase para GHOST-DROP

## Paso 1: Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Haz clic en "Start your project"
3. Crea una cuenta o inicia sesión
4. Crea un nuevo proyecto:
   - **Name**: ghost-drop (o el que prefieras)
   - **Database Password**: Guarda esta contraseña en un lugar seguro
   - **Region**: Elige la más cercana a ti
5. Espera 2-3 minutos mientras se crea el proyecto

---

## Paso 2: Obtener credenciales

1. En el dashboard de tu proyecto, ve a **Settings** (⚙️) → **API**
2. Copia estos dos valores:
   - **Project URL** (ejemplo: `https://abcdefgh.supabase.co`)
   - **anon public key** (una clave larga que empieza con `eyJ...`)

3. Pega estos valores en el archivo `supabase-config.js`:

```javascript
const SUPABASE_URL = "TU_PROJECT_URL_AQUI";
const SUPABASE_ANON_KEY = "TU_ANON_KEY_AQUI";
```

---

## Paso 3: Crear las tablas

1. En el dashboard, ve a **SQL Editor** (icono de base de datos)
2. Haz clic en **+ New query**
3. Copia y pega este código SQL completo:

```sql
-- 1. Crear tabla de salas
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear tabla de drops (archivos)
CREATE TABLE drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear índices para mejor rendimiento
CREATE INDEX drops_room_id_idx ON drops(room_id);
CREATE INDEX drops_expires_at_idx ON drops(expires_at);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;

-- 5. Políticas baseline para producción (sin auth de usuarios)
CREATE POLICY "rooms_select_all" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert_valid_code" ON rooms
  FOR INSERT
  WITH CHECK (id ~ '^[0-9]{6}$');
CREATE POLICY "rooms_update_valid_code" ON rooms
  FOR UPDATE
  USING (id ~ '^[0-9]{6}$')
  WITH CHECK (id ~ '^[0-9]{6}$');

CREATE POLICY "drops_select_all" ON drops FOR SELECT USING (true);
CREATE POLICY "drops_insert_guardrails" ON drops
  FOR INSERT
  WITH CHECK (
    room_id ~ '^[0-9]{6}$'
    AND file_size > 0
    AND file_size <= 524288000
    AND expires_at <= NOW() + interval '15 minutes'
  );
CREATE POLICY "drops_delete_all" ON drops FOR DELETE USING (true);
```

4. Haz clic en **Run** (▶️)
5. Deberías ver "Success. No rows returned"

---

## Paso 4: Habilitar Realtime

1. Ve a **Database** → **Replication**
2. Busca la tabla `drops`
3. Activa el toggle para habilitar Realtime
4. Guarda los cambios

---

## Paso 5: Crear el bucket de Storage

1. Ve a **Storage** en el menú lateral
2. Haz clic en **Create a new bucket**
3. Configuración:
   - **Name**: `ghost-drop`
   - **Public bucket**: ❌ NO (déjalo privado)
4. Haz clic en **Create bucket**

---

## Paso 6: Configurar políticas de Storage

1. En **Storage**, haz clic en el bucket `ghost-drop`
2. Ve a la pestaña **Policies**
3. Haz clic en **New policy** → **For full customization**
4. Crea 3 políticas:

### Política 1: Permitir subida
```sql
CREATE POLICY "anon_upload" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'ghost-drop');
```

### Política 2: Permitir descarga
```sql
CREATE POLICY "anon_download" ON storage.objects
FOR SELECT
USING (bucket_id = 'ghost-drop');
```

### Política 3: Permitir eliminación
```sql
CREATE POLICY "anon_delete" ON storage.objects
FOR DELETE
USING (bucket_id = 'ghost-drop');
```

O puedes ejecutar todo junto desde **SQL Editor**:

```sql
-- Políticas de Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ghost-drop', 'ghost-drop', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anon_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ghost-drop');

CREATE POLICY "anon_download" ON storage.objects
  FOR SELECT USING (bucket_id = 'ghost-drop');

CREATE POLICY "anon_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'ghost-drop');
```

---

## ✅ Verificación

Para verificar que todo está bien:

1. Ve a **Table Editor** → deberías ver las tablas `rooms` y `drops`
2. Ve a **Storage** → deberías ver el bucket `ghost-drop`
3. Ve a **Database** → **Replication** → `drops` debe estar activado

---

## 🚀 Siguiente paso

Una vez completados estos pasos, tu archivo `supabase-config.js` debería verse así:

```javascript
const SUPABASE_URL = "https://tuproyecto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

¡Ahora puedes probar la aplicación! 🎉
