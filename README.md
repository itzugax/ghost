# 👻 GHOST-DROP — Protocolo Fantasma

> "Si no estás aquí, no existe."

Plataforma de intercambio de archivos volátil. Los archivos solo son visibles para personas en la misma zona geográfica (~100m) o conectadas al mismo router. Se auto-destruyen al ser descargados o tras 5 minutos.

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
-- Rooms: cualquiera puede leer/insertar
alter table rooms enable row level security;
create policy "public rooms" on rooms for all using (true) with check (true);

-- Drops: cualquiera puede leer/insertar/borrar (la sala actúa como "contraseña")
alter table drops enable row level security;
create policy "public drops" on drops for all using (true) with check (true);
```

```sql
-- Storage: permitir subida y descarga anónima en el bucket ghost-drop
insert into storage.buckets (id, name, public) values ('ghost-drop', 'ghost-drop', false);

create policy "anon upload" on storage.objects
  for insert with check (bucket_id = 'ghost-drop');

create policy "anon download" on storage.objects
  for select using (bucket_id = 'ghost-drop');

create policy "anon delete" on storage.objects
  for delete using (bucket_id = 'ghost-drop');
```

### 6. (Opcional) Edge Function para limpieza automática

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

- La "sala" se deriva de la IP pública o coordenadas GPS redondeadas. No es criptográficamente segura — es oscuridad por diseño, no cifrado.
- Para producción considera añadir un PIN de sala opcional.
- El bucket de Storage es privado; los archivos solo se descargan via la anon key de Supabase.

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
