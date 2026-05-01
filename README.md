# 👻 GHOST-DROP

> Comparte archivos en 5 segundos. Sin registro. Sin apps. Cifrado E2E.

**El problema:** Compartir un archivo en 2026 requiere registro, descargar apps, crear cuentas, esperar verificaciones...

**Ghost Drop:** Código de 6 dígitos → Arrastra archivo → Listo. **Cero fricción.**

---

## 🚀 Por qué es diferente

| Otras apps | Ghost Drop |
|------------|------------|
| ❌ Registro obligatorio | ✅ Cero registro |
| ❌ Descarga app (50MB+) | ✅ Solo web |
| ❌ Login con email | ✅ Código de 6 dígitos |
| ❌ Archivos permanentes | ✅ Auto-destrucción |
| ❌ 5 minutos de setup | ✅ 5 segundos |
| ❌ Sin cifrado o cifrado opaco | ✅ Cifrado E2E transparente |

## 🔐 Seguridad

- **Cifrado E2E real**: AES-256-GCM usando Web Crypto API para archivos y textos
- **Clave derivada del código de sala**: PBKDF2 con 100,000 iteraciones
- **Supabase solo ve payloads cifrados**: Ni siquiera nosotros podemos leer tus archivos ni textos
- **Auto-destrucción**: Los archivos se borran automáticamente (1-15 min)
- **Sin metadatos**: No guardamos IPs, emails, ni identificadores personales

## 💡 Casos de uso

- 🎤 **Eventos/conferencias**: "Escanea el QR para las slides"
- 💼 **Reuniones**: Sin "¿me lo mandas por email?"
- 🏫 **Aulas**: Profesor → 30 estudiantes en segundos
- 🏢 **Oficinas**: Entre escritorios sin Slack/Teams
- ✈️ **Viajes**: Comparte fotos sin WhatsApp comprimido
- 🔧 **Soporte técnico**: Envía logs sin subir a servicios públicos

---

## 🛠️ Setup en Supabase

### 1. Crear proyecto en [supabase.com](https://supabase.com)

### 2. Crear las tablas (SQL Editor)

```sql
-- Tabla de salas
create table rooms (
  id text primary key,
  last_seen timestamptz default now()
);

-- Tabla de drops
create table drops (
  id uuid primary key default gen_random_uuid(),
  room_id text references rooms(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  storage_path text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Índice para consultas por sala
create index drops_room_id_idx on drops(room_id);
create index drops_expires_at_idx on drops(expires_at);
```

### 3. Habilitar Realtime

En el dashboard de Supabase:
- **Database → Replication** → activa la tabla `drops`

### 4. Crear el bucket de Storage

- Nombre: `ghost-drop`
- Tipo: **Private** (los archivos se sirven via signed URLs o download directo con anon key)

### 5. Row Level Security (RLS)

```sql
-- Rooms: politica minima para pruebas/MVP
alter table rooms enable row level security;
create policy "public rooms" on rooms for all using (true) with check (true);

-- Drops: politica minima para pruebas/MVP
alter table drops enable row level security;
create policy "public drops" on drops for all using (true) with check (true);
```

```sql
-- Storage: politicas minimas para pruebas/MVP
insert into storage.buckets (id, name, public) values ('ghost-drop', 'ghost-drop', false);

create policy "anon upload" on storage.objects
  for insert with check (bucket_id = 'ghost-drop');

create policy "anon download" on storage.objects
  for select using (bucket_id = 'ghost-drop');

create policy "anon delete" on storage.objects
  for delete using (bucket_id = 'ghost-drop');
```

### 6. Edge Function obligatoria para limpieza real

Sin esta funcion, la UI puede ocultar archivos expirados pero el objeto fisico puede seguir en Supabase Storage.

Crea una Edge Function con cron cada minuto para borrar drops expirados:

```typescript
// supabase/functions/cleanup/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await supabase
    .from("drops")
    .select("id, storage_path")
    .lt("expires_at", new Date().toISOString());

  if (data?.length) {
    await supabase.storage.from("ghost-drop").remove(data.map(d => d.storage_path));
    await supabase.from("drops").delete().in("id", data.map(d => d.id));
  }

  return new Response("ok");
});
```

Deploy y schedule:

```bash
supabase functions deploy cleanup --no-verify-jwt
```

Luego programa la funcion desde Supabase para correr cada `1 minute` o `5 minutes`.

Prueba recomendada:

1. Sube un archivo con TTL de `1 min`.
2. Verifica que aparezca en `drops` y en el bucket `ghost-drop`.
3. Espera 60-90 segundos.
4. Comprueba que desaparece de la UI y luego de Supabase.
5. Si quieres forzarlo mientras pruebas, usa el boton `Limpiar expirados` dentro de la sala.

### 7. Configurar credenciales

Edita `supabase-config.js`:

```js
const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU_ANON_KEY";
```

---

## 🚀 Correr localmente

Cualquier servidor estático sirve. Ejemplo con Python:

```bash
cd GHOST-DROP
python -m http.server 3000
```

O con Node:
```bash
npx serve .
```

---

## 🔒 Notas de seguridad

- **Cifrado E2E**: Todos los archivos se cifran en tu navegador antes de subirlos. La clave se deriva del código de sala usando PBKDF2.
- **Textos y archivos**: Ambos se cifran en el navegador antes de persistirse.
- **Supabase no puede leer tus archivos**: Solo almacena payloads cifrados.
- **El código de sala es la clave**: Cualquiera con el código puede descifrar. Compártelo solo con quien confíes.
- **Importante**: Un código de 6 dígitos prioriza facilidad de uso, no máxima resistencia ante ataques offline. Para un entorno más sensible conviene usar secretos más largos.
- **Auto-destrucción**: Requiere tener activo el cleanup server-side en Supabase para borrar tambien el objeto fisico del bucket.
- **Sin tracking**: No guardamos IPs, emails, ni identificadores personales.

---

## 📁 Estructura

```
GHOST-DROP/
├── index.html          # UI principal
├── style.css           # Estética terminal/hacker
├── app.js              # Lógica completa (geo, upload, download, realtime)
├── supabase-config.js  # Credenciales (no commitear en producción)
└── README.md
```
